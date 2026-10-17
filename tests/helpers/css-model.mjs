// TEST-HYGIENE-001: a parsed model of a stylesheet plus a small cascade.
//
// Tests ask what a selector or a DOM element actually resolves to (under a
// given viewport, motion preference, theme and interaction state) instead of
// matching the stylesheet's source text, so formatting, reordering and
// consolidation of rules no longer break them.

import fs from 'node:fs';
import {
  compareSpecificity,
  matchesComplex,
  parseSelector,
  splitSelectorList,
  specificity,
} from './selector-engine.mjs';

function stripComments(text) {
  let output = '';
  let index = 0;
  let quote = null;
  while (index < text.length) {
    const char = text[index];
    if (quote) {
      output += char;
      if (char === '\\') { output += text[index + 1] ?? ''; index += 2; continue; }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; output += char; index += 1; continue; }
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      output += ' ';
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function findBlockEnd(text, open) {
  let depth = 0;
  let quote = null;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new SyntaxError('Unterminated CSS block');
}

export function parseDeclarations(body) {
  const declarations = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  const flush = (end) => {
    const chunk = body.slice(start, end).trim();
    start = end + 1;
    if (!chunk) return;
    const colon = chunk.indexOf(':');
    if (colon < 0) return;
    const property = chunk.slice(0, colon).trim();
    let value = chunk.slice(colon + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/\s*!\s*important\s*$/i, '');
    declarations.push({
      property: property.startsWith('--') ? property : property.toLowerCase(),
      value: value.replace(/\s+/g, ' ').trim(),
      important,
    });
  };
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ';' && depth === 0) flush(index);
  }
  flush(body.length);
  return declarations;
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, ' $1 ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
    .replace(/ , /g, ', ');
}

function normalizeQuery(query) {
  return query.replace(/\s+/g, ' ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*:\s*/g, ': ').trim().toLowerCase();
}

function parseBlock(text, conditions, model) {
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index += 1;
    if (index >= text.length) break;
    const brace = text.indexOf('{', index);
    const semicolon = text.indexOf(';', index);
    if (text[index] === '@' && semicolon >= 0 && (brace < 0 || semicolon < brace)) {
      model.statements.push(text.slice(index, semicolon).trim());
      index = semicolon + 1;
      continue;
    }
    if (brace < 0) break;
    const prelude = text.slice(index, brace).trim();
    const end = findBlockEnd(text, brace);
    const body = text.slice(brace + 1, end);
    index = end + 1;
    if (prelude.startsWith('@')) {
      const [, name, rest = ''] = prelude.match(/^@([-\w]+)\s*([\s\S]*)$/);
      const keyword = name.toLowerCase();
      if (keyword === 'keyframes' || keyword.endsWith('-keyframes')) {
        const frames = [];
        parseBlock(body, [], { rules: frames, statements: [], keyframes: new Map(), fontFaces: [], order: { value: 0 } });
        model.keyframes.set(rest.trim(), frames.map((frame) => ({ offsets: frame.selectors, declarations: frame.declarations })));
      } else if (keyword === 'font-face') {
        model.fontFaces.push(parseDeclarations(body));
      } else if (['media', 'supports', 'container', 'layer', 'scope', 'document'].includes(keyword)) {
        parseBlock(body, [...conditions, { type: keyword, query: rest.trim() }], model);
      } else {
        parseBlock(body, [...conditions, { type: keyword, query: rest.trim() }], model);
      }
      continue;
    }
    const selectors = splitSelectorList(prelude).map(normalizeSelector);
    model.rules.push({
      selectorText: selectors.join(', '),
      selectors,
      declarations: parseDeclarations(body),
      conditions,
      order: model.order.value += 1,
    });
  }
}

/* -------------------------------------------------------- environments */

const DEFAULT_ENVIRONMENT = Object.freeze({
  width: 1920,
  height: 1080,
  reducedMotion: false,
  colorScheme: 'dark',
  hover: true,
  pointer: 'fine',
  forcedColors: false,
  contrast: 'no-preference',
  print: false,
  // Container queries: map of container name (or '*') to inline size. When
  // absent, a container query does not apply.
  containers: {},
  // @supports conditions are assumed true unless listed here.
  unsupported: [],
});

function toPixels(value) {
  const match = String(value).trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!match) throw new SyntaxError(`Unsupported media length ${value}`);
  const number = Number(match[1]);
  return match[2] === 'rem' || match[2] === 'em' ? number * 16 : number;
}

function evaluateFeature(feature, environment, size = { width: environment.width, height: environment.height }) {
  const text = feature.trim();
  const range = text.match(/^(width|height|inline-size|block-size)\s*(<=|>=|<|>|=)\s*([\d.]+\w*)$/);
  if (range) {
    const actual = /width|inline/.test(range[1]) ? size.width : size.height;
    const limit = toPixels(range[3]);
    return { '<=': actual <= limit, '>=': actual >= limit, '<': actual < limit, '>': actual > limit, '=': actual === limit }[range[2]];
  }
  const [rawName, rawValue] = text.split(':').map((part) => part?.trim());
  const name = rawName.toLowerCase();
  const value = rawValue?.toLowerCase();
  switch (name) {
    case 'max-width': case 'max-inline-size': return size.width <= toPixels(value);
    case 'min-width': case 'min-inline-size': return size.width >= toPixels(value);
    case 'max-height': case 'max-block-size': return size.height <= toPixels(value);
    case 'min-height': case 'min-block-size': return size.height >= toPixels(value);
    case 'prefers-reduced-motion': return value === undefined ? environment.reducedMotion : (value === 'reduce') === environment.reducedMotion;
    case 'prefers-color-scheme': return value === environment.colorScheme;
    case 'hover': return value === undefined ? environment.hover : (value === 'hover') === environment.hover;
    case 'any-hover': return (value === 'hover') === environment.hover;
    case 'pointer': case 'any-pointer': return value === environment.pointer;
    case 'forced-colors': return (value === 'active') === environment.forcedColors;
    case 'prefers-contrast': return value === environment.contrast;
    case 'orientation': return value === (environment.width >= environment.height ? 'landscape' : 'portrait');
    case 'display-mode': return value === 'browser';
    case 'min-resolution': case 'max-resolution': case '-webkit-min-device-pixel-ratio': return false;
    default: throw new SyntaxError(`Unsupported media feature (${text})`);
  }
}

function evaluateMediaQuery(query, environment) {
  return query.split(',').some((single) => {
    let text = single.trim().toLowerCase();
    let negate = false;
    if (text.startsWith('not ')) { negate = true; text = text.slice(4); }
    text = text.replace(/^only\s+/, '');
    const parts = text.split(/\s+and\s+/);
    const result = parts.every((part) => {
      const trimmed = part.trim();
      if (trimmed === 'screen' || trimmed === 'all') return true;
      if (trimmed === 'print') return environment.print;
      const inner = trimmed.match(/^\((.*)\)$/s);
      if (!inner) throw new SyntaxError(`Unsupported media query part ${trimmed}`);
      if (/^not\s/.test(inner[1])) return !evaluateFeature(inner[1].slice(4).replace(/^\(|\)$/g, ''), environment);
      return evaluateFeature(inner[1], environment);
    });
    return negate ? !result : result;
  });
}

function evaluateContainerQuery(query, environment) {
  const match = query.trim().match(/^([-\w]+)?\s*(\(.*\))$/s);
  if (!match) throw new SyntaxError(`Unsupported container query ${query}`);
  const name = match[1] || '*';
  const width = environment.containers?.[name] ?? environment.containers?.['*'];
  if (width == null) return false;
  return match[2].split(/\s+and\s+/).every((part) => evaluateFeature(part.trim().replace(/^\(|\)$/g, ''), environment, { width, height: Infinity }));
}

export function conditionsApply(conditions, environment) {
  return conditions.every(({ type, query }) => {
    if (type === 'media') return evaluateMediaQuery(query, environment);
    if (type === 'container') return evaluateContainerQuery(query, environment);
    if (type === 'supports') return !environment.unsupported.some((item) => query.includes(item));
    if (type === 'layer') return true;
    return false;
  });
}

/* --------------------------------------------------------------- model */

const INHERITED = new Set([
  'color', 'cursor', 'direction', 'font', 'font-family', 'font-feature-settings', 'font-kerning', 'font-size',
  'font-style', 'font-variant', 'font-variant-numeric', 'font-weight', 'letter-spacing', 'line-height', 'list-style',
  'quotes', 'text-align', 'text-indent', 'text-transform', 'visibility', 'white-space', 'word-break', 'word-spacing',
  'overflow-wrap', 'word-wrap', 'hyphens', 'text-wrap', 'tab-size', 'caret-color', 'color-scheme', 'unicode-bidi-inherit',
  'pointer-events', 'user-select', 'text-rendering', '-webkit-font-smoothing', 'font-optical-sizing', 'text-shadow',
]);

export class StyleSheetModel {
  constructor(text) {
    this.source = text;
    const model = { rules: [], statements: [], keyframes: new Map(), fontFaces: [], order: { value: 0 } };
    parseBlock(stripComments(text), [], model);
    this.rules = model.rules;
    this.keyframes = model.keyframes;
    this.fontFaces = model.fontFaces;
    this.statements = model.statements;
    this._bySelector = new Map();
    for (const rule of this.rules) {
      for (const selector of rule.selectors) {
        const list = this._bySelector.get(selector) || [];
        list.push(rule);
        this._bySelector.set(selector, list);
      }
    }
  }

  static fromFile(url) {
    return new StyleSheetModel(fs.readFileSync(url, 'utf8'));
  }

  environment(overrides = {}) {
    return { ...DEFAULT_ENVIRONMENT, ...overrides };
  }

  /** Rules (in source order) whose selector list contains exactly `selector`. */
  rulesFor(selector, { media, condition, anyCondition = false } = {}) {
    const rules = this._bySelector.get(normalizeSelector(selector)) || [];
    return rules.filter((rule) => {
      if (anyCondition) return true;
      if (condition) return condition(rule.conditions);
      if (media === undefined) return rule.conditions.length === 0;
      return rule.conditions.some((entry) => entry.type === 'media' && normalizeQuery(entry.query) === normalizeQuery(media));
    });
  }

  /** Selectors that appear in any rule (normalized). */
  hasSelector(selector) { return this._bySelector.has(normalizeSelector(selector)); }

  /** Every rule whose selector list mentions `fragment` (class, id, attribute...). */
  rulesMentioning(fragment) {
    return this.rules.filter((rule) => rule.selectors.some((selector) => selector.includes(fragment)));
  }

  /**
   * The value an exact selector declares for `property` after the cascade among
   * rules with that same selector that apply in `environment` (later rules and
   * !important win). Returns undefined when no applicable rule declares it.
   */
  declared(selector, property, environment = {}) {
    const env = this.environment(environment);
    let winner;
    for (const rule of this._bySelector.get(normalizeSelector(selector)) || []) {
      if (!conditionsApply(rule.conditions, env)) continue;
      for (const declaration of rule.declarations) {
        if (!propertyMatches(declaration.property, property)) continue;
        if (winner?.important && !declaration.important) continue;
        winner = declaration;
      }
    }
    return winner ? expandShorthand(winner, property) : undefined;
  }

  /** All declarations (across applicable rules) for an exact selector, merged. */
  declarations(selector, environment = {}) {
    const env = this.environment(environment);
    const merged = new Map();
    for (const rule of this._bySelector.get(normalizeSelector(selector)) || []) {
      if (!conditionsApply(rule.conditions, env)) continue;
      for (const declaration of rule.declarations) {
        const previous = merged.get(declaration.property);
        if (previous?.important && !declaration.important) continue;
        merged.set(declaration.property, declaration);
      }
    }
    return Object.fromEntries([...merged].map(([name, declaration]) => [name, declaration.value]));
  }

  /**
   * Cascaded value of `property` for a DOM element (mini-dom) in an
   * environment. `pseudoElement` selects ::before/::after rules; `states`
   * enables :hover/:active/:focus-visible on `stateElement` (or any element).
   * Inherited properties and custom properties walk up the tree.
   */
  cascaded(element, property, options = {}) {
    const env = this.environment(options.environment || options);
    const context = { states: options.states ? new Set(options.states) : undefined, stateElement: options.stateElement, allowPseudoElements: Boolean(options.pseudoElement) };
    const dir = directionOf(element);
    let best = null;
    const consider = (declaration, rank) => {
      if (!best) { best = { declaration, rank }; return; }
      if (declaration.important !== best.declaration.important) {
        if (declaration.important) best = { declaration, rank };
        return;
      }
      if (compareRank(rank, best.rank) >= 0) best = { declaration, rank };
    };
    let bestRule = null;
    const matched = new Map();
    for (const entry of this._candidates(element, this._propertyIndex(property))) {
      if ((entry.pseudoElement || null) !== (options.pseudoElement || null)) continue;
      if (!conditionsApply(entry.rule.conditions, env)) continue;
      if (!matchesComplex(element, entry.complex, context)) continue;
      const previous = matched.get(entry.rule);
      if (!previous || compareSpecificity(entry.specificity, previous) > 0) matched.set(entry.rule, entry.specificity);
    }
    for (const [rule, ruleSpecificity] of matched) {
      for (const declaration of rule.declarations) {
        if (!propertyMatches(declaration.property, property, dir)) continue;
        const before = best;
        consider(declaration, [...ruleSpecificity, rule.order]);
        if (best !== before) bestRule = rule;
      }
    }
    const inline = !options.pseudoElement && element.style?.getPropertyValue?.(property);
    if (inline && (!best || !best.declaration.important || element.style.getPropertyPriority(property))) {
      return inline;
    }
    if (best) {
      if (options.explain) options.explain.rule = bestRule;
      const value = expandShorthand(best.declaration, property, dir);
      if (value === 'inherit' && element.parentElement) return this.cascaded(element.parentElement, property, { ...options, pseudoElement: null });
      return value;
    }
    const inherits = property.startsWith('--') || INHERITED.has(property);
    const parent = options.pseudoElement ? element : element.parentElement;
    if (inherits && parent) return this.cascaded(parent, property, { ...options, pseudoElement: null });
    return undefined;
  }

  /** Rules (in source order) that apply to an element in an environment. */
  matchingRules(element, options = {}) {
    const env = this.environment(options.environment || options);
    const context = { states: options.states ? new Set(options.states) : undefined, stateElement: options.stateElement, allowPseudoElements: true };
    const rules = new Set();
    for (const entry of this._candidates(element, this._propertyIndex(null))) {
      if (rules.has(entry.rule)) continue;
      if ((entry.pseudoElement || null) !== (options.pseudoElement || null)) continue;
      if (conditionsApply(entry.rule.conditions, env) && matchesComplex(element, entry.complex, context)) rules.add(entry.rule);
    }
    return [...rules].sort((left, right) => left.order - right.order);
  }

  // Rule hashing (as browsers do): each selector is bucketed by its key
  // (rightmost) compound's id, first class or tag, so lookups only test
  // selectors that can possibly match an element.
  _propertyIndex(property) {
    this._indexes ||= new Map();
    const key = property ?? '*all*';
    if (this._indexes.has(key)) return this._indexes.get(key);
    const buckets = new Map();
    const add = (bucket, entry) => {
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(entry);
    };
    for (const rule of this.rules) {
      // Either direction: the index is shared by LTR and RTL elements.
      if (property !== null && !rule.declarations.some((declaration) => propertyMatches(declaration.property, property, 'ltr')
        || propertyMatches(declaration.property, property, 'rtl'))) continue;
      for (const selector of rule.selectors) {
        let complex;
        try {
          [complex] = parseSelector(selector);
        } catch (error) {
          // A skipped rule could hide the real cascade winner: report it.
          throw new SyntaxError(`css-model cannot evaluate selector "${selector}" (${error.message}); `
            + 'extend tests/helpers/selector-engine.mjs instead of skipping the rule', { cause: error });
        }
        const compound = complex.parts.at(-1).compound;
        const entry = { rule, selector, complex, pseudoElement: compound.pseudoElement, specificity: specificity(selector) };
        if (compound.ids.length) add(`#${compound.ids[0]}`, entry);
        else if (compound.classes.length) add(`.${compound.classes[0]}`, entry);
        else if (compound.tag && compound.tag !== '*') add(compound.tag, entry);
        else add('*', entry);
      }
    }
    this._indexes.set(key, buckets);
    return buckets;
  }

  *_candidates(element, buckets) {
    const keys = ['*', element.localName];
    if (element.id) keys.push(`#${element.id}`);
    for (const className of element.classList || []) keys.push(`.${className}`);
    for (const key of keys) yield* buckets.get(key) || [];
  }

  /** Cascaded value with var() references resolved against the element's custom properties. */
  resolved(element, property, options = {}) {
    const value = this.cascaded(element, property, options);
    return value === undefined ? undefined : this.resolveVars(element, value, options);
  }

  resolveVars(element, value, options = {}, depth = 0) {
    if (depth > 20) throw new Error(`var() cycle while resolving ${value}`);
    return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name, fallback) => {
      const found = this.cascaded(element, name, options);
      const next = found ?? fallback;
      return next === undefined ? '' : this.resolveVars(element, next.trim(), options, depth + 1);
    });
  }

  /** Whether a property declared anywhere for an exact selector (any condition). */
  declaresAnywhere(selector, property) {
    return (this._bySelector.get(normalizeSelector(selector)) || [])
      .some((rule) => rule.declarations.some((declaration) => propertyMatches(declaration.property, property)));
  }
}

function compareRank(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

const SHORTHANDS = {
  'border-inline-start': ['border-inline', 'border'],
  'border-inline-end': ['border-inline', 'border'],
  'border-block-start': ['border-block', 'border'],
  'border-block-end': ['border-block', 'border'],
  'border-top': ['border', 'border-block'],
  'border-bottom': ['border', 'border-block'],
  'border-left': ['border', 'border-inline'],
  'border-right': ['border', 'border-inline'],
  'padding-top': ['padding'], 'padding-bottom': ['padding'], 'padding-left': ['padding'], 'padding-right': ['padding'],
  'padding-inline-start': ['padding-inline', 'padding'], 'padding-inline-end': ['padding-inline', 'padding'],
  'padding-block-start': ['padding-block', 'padding'], 'padding-block-end': ['padding-block', 'padding'],
  'margin-top': ['margin'], 'margin-bottom': ['margin'], 'margin-left': ['margin'], 'margin-right': ['margin'],
  'margin-inline-start': ['margin-inline', 'margin'], 'margin-inline-end': ['margin-inline', 'margin'],
  'margin-block-start': ['margin-block', 'margin'], 'margin-block-end': ['margin-block', 'margin'],
  'overflow-x': ['overflow'], 'overflow-y': ['overflow'],
  'grid-template-columns': ['grid-template'], 'grid-template-rows': ['grid-template'],
  'animation-name': ['animation'], 'animation-duration': ['animation'],
  'transition-property': ['transition'], 'transition-duration': ['transition'],
  'flex-direction': ['flex-flow'], 'flex-wrap': ['flex-flow'],
  'background-color': ['background'], 'background-image': ['background'],
  'row-gap': ['gap'], 'column-gap': ['gap'],
  'inset-inline-start': ['inset-inline', 'inset'], 'inset-inline-end': ['inset-inline', 'inset'],
  'top': ['inset'], 'bottom': ['inset'], 'left': ['inset'], 'right': ['inset'],
  'border-radius': [],
  'font-size': ['font'], 'font-weight': ['font'], 'font-family': ['font'], 'line-height': ['font'],
  'outline-color': ['outline'], 'outline-style': ['outline'], 'outline-width': ['outline'],
  'border-color': ['border'], 'border-style': ['border'], 'border-width': ['border'],
  'place-items': [], 'align-items': ['place-items'], 'justify-items': ['place-items'],
  'align-content': ['place-content'], 'justify-content': ['place-content'],
  'text-decoration-line': ['text-decoration'],
  'list-style-type': ['list-style'],
  'overscroll-behavior-x': ['overscroll-behavior'], 'overscroll-behavior-y': ['overscroll-behavior'],
  'mask-image': ['mask'], '-webkit-mask-image': ['-webkit-mask'],
  'flex-grow': ['flex'], 'flex-shrink': ['flex'], 'flex-basis': ['flex'],
  'padding-block': ['padding'], 'padding-inline': ['padding'],
  'margin-block': ['margin'], 'margin-inline': ['margin'],
};

// Logical and physical properties share one value in horizontal writing modes.
const ALIASES = {
  width: 'inline-size', 'inline-size': 'width',
  height: 'block-size', 'block-size': 'height',
  'min-width': 'min-inline-size', 'min-inline-size': 'min-width',
  'max-width': 'max-inline-size', 'max-inline-size': 'max-width',
  'min-height': 'min-block-size', 'min-block-size': 'min-height',
  'max-height': 'max-block-size', 'max-block-size': 'max-height',
};

// Logical sides map to physical ones by direction (horizontal-tb writing mode):
// block-start/end are top/bottom; inline-start/end are left/right in LTR and
// right/left in RTL.
const LOGICAL_SIDES = {
  ltr: { 'block-start': 'top', 'block-end': 'bottom', 'inline-start': 'left', 'inline-end': 'right' },
  rtl: { 'block-start': 'top', 'block-end': 'bottom', 'inline-start': 'right', 'inline-end': 'left' },
};
const SIDED = '(padding|margin|border|scroll-margin|scroll-padding)';

/** Properties that share a value with `name` for an element in direction `dir`. */
function equivalentProperties(name, dir = 'ltr') {
  const sides = LOGICAL_SIDES[dir] || LOGICAL_SIDES.ltr;
  const out = [];
  if (ALIASES[name]) out.push(ALIASES[name]);
  let match = name.match(new RegExp(`^${SIDED}-((?:block|inline)-(?:start|end))(-.+)?$`));
  if (match) out.push(`${match[1]}-${sides[match[2]]}${match[3] || ''}`);
  match = name.match(/^inset-((?:block|inline)-(?:start|end))$/);
  if (match) out.push(sides[match[1]]);
  match = name.match(new RegExp(`^${SIDED}-(top|bottom|left|right)(-.+)?$`));
  const logicalOf = (side) => Object.keys(sides).find((key) => sides[key] === side);
  if (match) out.push(`${match[1]}-${logicalOf(match[2])}${match[3] || ''}`);
  if (/^(top|bottom|left|right)$/.test(name)) out.push(`inset-${logicalOf(name)}`);
  return out;
}

function propertyMatches(declared, wanted, dir = 'ltr') {
  for (const name of [wanted, ...equivalentProperties(wanted, dir)]) {
    if (declared === name || (SHORTHANDS[name] || []).includes(declared)) return true;
  }
  return false;
}

/** Direction of an element from the nearest `dir` attribute (default LTR). */
function directionOf(element) {
  for (let current = element; current?.nodeType === 1; current = current.parentNode) {
    const dir = current.getAttribute?.('dir');
    if (dir === 'rtl' || dir === 'ltr') return dir;
  }
  return 'ltr';
}

function splitValue(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function boxSide(parts, side) {
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left }[side];
}

/** Extract the longhand value from a shorthand declaration when needed. */
function expandShorthand(declaration, wanted, dir = 'ltr') {
  if (declaration.property === wanted) return declaration.value;
  // A logical/physical equivalent declares the same longhand.
  if (equivalentProperties(wanted, dir).includes(declaration.property)) return declaration.value;
  const { property, value } = declaration;
  const parts = splitValue(value);
  const sides = LOGICAL_SIDES[dir] || LOGICAL_SIDES.ltr;
  // The physical side a longhand addresses (top/right/bottom/left), if any.
  const physicalSide = (name) => {
    const physical = name.match(/(?:^|-)(top|bottom|left|right)(?:-(?:color|style|width))?$/)?.[1];
    if (physical) return physical;
    const logical = name.match(/((?:block|inline)-(?:start|end))(?:-(?:color|style|width))?$/)?.[1];
    return logical ? sides[logical] : null;
  };
  if (property === 'padding' || property === 'margin' || property === 'inset') {
    const side = physicalSide(wanted);
    if (side) return boxSide(parts, side);
  }
  if (/^(padding|margin|inset)-(inline|block)$/.test(property)) {
    const [start, end = start] = parts;
    const side = physicalSide(wanted);
    const logical = side ? Object.keys(sides).find((key) => sides[key] === side) : wanted;
    return /-start$/.test(logical || wanted) ? start : end;
  }
  if (property === 'font' && ['font-weight', 'font-size', 'font-family', 'line-height', 'font-style'].includes(wanted)) {
    const isWeight = (token) => /^(\d{3}|bold|bolder|lighter|normal|var\(--weight[^)]*\))$/.test(token);
    const isStyle = (token) => /^(italic|oblique|normal)$/.test(token);
    let index = 0;
    let style = 'normal';
    let weight = 'normal';
    while (index < parts.length - 1 && (isStyle(parts[index]) || isWeight(parts[index]) || /^small-caps$/.test(parts[index]))) {
      if (isWeight(parts[index]) && !(parts[index] === 'normal' && weight !== 'normal')) weight = parts[index];
      else if (isStyle(parts[index])) style = parts[index];
      index += 1;
    }
    const [size, lineHeight = 'normal'] = (parts[index] || '').split('/');
    const family = parts.slice(index + 1).join(' ');
    return { 'font-weight': weight, 'font-size': size, 'font-family': family, 'line-height': lineHeight, 'font-style': style }[wanted];
  }
  if (property === 'flex') {
    const keyword = { none: ['0', '0', 'auto'], auto: ['1', '1', 'auto'], initial: ['0', '1', 'auto'] }[value];
    let [grow, shrink, basis] = keyword || [];
    if (!keyword) {
      const numbers = parts.filter((part) => /^[\d.]+$/.test(part));
      const sizes = parts.filter((part) => !/^[\d.]+$/.test(part));
      grow = numbers[0] ?? '1';
      shrink = numbers[1] ?? '1';
      basis = sizes[0] ?? (numbers.length ? '0%' : 'auto');
    }
    return { 'flex-grow': grow, 'flex-shrink': shrink, 'flex-basis': basis }[wanted] ?? value;
  }
  if (/^(padding|margin)$/.test(property) && /-(block|inline)$/.test(wanted)) {
    const [top, right = top, bottom = top, left = right] = parts;
    return wanted.endsWith('-block') ? (top === bottom ? top : `${top} ${bottom}`) : (right === left ? right : `${right} ${left}`);
  }
  if (property === 'overflow') {
    const [x, y = x] = parts;
    return wanted === 'overflow-x' ? x : y;
  }
  if (property === 'gap') {
    const [row, column = row] = parts;
    return wanted === 'row-gap' ? row : column;
  }
  if (property === 'place-items' || property === 'place-content') {
    const [align, justify = align] = parts;
    return wanted.startsWith('align') ? align : justify;
  }
  if (property === 'grid-template') {
    const [rows, columns = 'none'] = value.split('/').map((part) => part.trim());
    return wanted === 'grid-template-rows' ? rows : columns;
  }
  if (property === 'overscroll-behavior') {
    const [x, y = x] = parts;
    return wanted.endsWith('-x') ? x : y;
  }
  // Composite shorthands (border, outline, font, background, animation...):
  // return the whole shorthand value; callers match the component they need.
  return value;
}

let appStyles = null;
/** The parsed app/styles.css (cached per process). */
export function appStyleSheet() {
  appStyles ||= StyleSheetModel.fromFile(new URL('../../app/styles.css', import.meta.url));
  return appStyles;
}
