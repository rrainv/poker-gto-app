// TEST-HYGIENE-001: a small CSS selector engine shared by the test DOM and the
// test CSS cascade. It covers the selector grammar used by app/index.html,
// app/styles.css and app/src/core/logic.js; unsupported syntax throws instead
// of silently matching nothing.

const cache = new Map();

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function splitSelectorList(text) {
  return splitTopLevel(text, ',');
}

const IDENT = /^-?(?:[_a-zA-Z -￿]|\\.)(?:[-\w -￿]|\\.)*/;

function unescapeIdent(value) {
  return value.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_, escaped) => (
    /^[0-9a-fA-F]/.test(escaped) && escaped.trim().length > 1
      ? String.fromCodePoint(Number.parseInt(escaped.trim(), 16))
      : escaped
  ));
}

function readBalanced(text, index) {
  // text[index] === '('
  let depth = 0;
  let quote = null;
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote) {
      if (char === '\\') cursor += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(index + 1, cursor), end: cursor + 1 };
    }
  }
  throw new SyntaxError(`Unbalanced selector: ${text}`);
}

function parseNth(argument) {
  const value = argument.replace(/\s+/g, '').toLowerCase();
  if (value === 'odd') return { a: 2, b: 1 };
  if (value === 'even') return { a: 2, b: 0 };
  const match = value.match(/^([+-]?\d*)n([+-]\d+)?$/);
  if (match) {
    const a = match[1] === '' || match[1] === '+' ? 1 : match[1] === '-' ? -1 : Number(match[1]);
    return { a, b: Number(match[2] || 0) };
  }
  if (/^[+-]?\d+$/.test(value)) return { a: 0, b: Number(value) };
  throw new SyntaxError(`Unsupported nth expression: ${argument}`);
}

function nthMatches({ a, b }, position) {
  if (a === 0) return position === b;
  const n = (position - b) / a;
  return Number.isInteger(n) && n >= 0;
}

function parseCompound(text, index) {
  const compound = { tag: null, ids: [], classes: [], attributes: [], pseudos: [], pseudoElement: null };
  let cursor = index;
  let consumed = false;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === '*') {
      compound.tag = '*';
      cursor += 1;
    } else if (char === '#' || char === '.') {
      const match = text.slice(cursor + 1).match(IDENT);
      if (!match) throw new SyntaxError(`Bad selector near "${text.slice(cursor)}"`);
      (char === '#' ? compound.ids : compound.classes).push(unescapeIdent(match[0]));
      cursor += 1 + match[0].length;
    } else if (char === '[') {
      const close = text.indexOf(']', cursor);
      const body = text.slice(cursor + 1, close).trim();
      const match = body.match(/^([-\w:|]+)\s*(?:([~|^$*]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\]]+))\s*([is])?)?$/);
      if (!match) throw new SyntaxError(`Bad attribute selector [${body}]`);
      compound.attributes.push({
        name: match[1].toLowerCase(),
        operator: match[2] || null,
        value: match[2] ? unescapeIdent(match[3] ?? match[4] ?? match[5] ?? '') : null,
        insensitive: match[6] === 'i',
      });
      cursor = close + 1;
    } else if (char === ':') {
      const isElement = text[cursor + 1] === ':';
      const nameStart = cursor + (isElement ? 2 : 1);
      const match = text.slice(nameStart).match(/^[-\w]+/);
      if (!match) throw new SyntaxError(`Bad pseudo near "${text.slice(cursor)}"`);
      const name = match[0].toLowerCase();
      cursor = nameStart + match[0].length;
      let argument = null;
      if (text[cursor] === '(') {
        const balanced = readBalanced(text, cursor);
        argument = balanced.inner.trim();
        cursor = balanced.end;
      }
      if (isElement) {
        compound.pseudoElement = argument == null ? name : `${name}(${argument})`;
      } else if (['before', 'after', 'first-line', 'first-letter'].includes(name)) {
        compound.pseudoElement = name;
      } else {
        compound.pseudos.push({ name, argument });
      }
    } else if (IDENT.test(text.slice(cursor)) && !consumed) {
      const match = text.slice(cursor).match(IDENT);
      compound.tag = match[0].toLowerCase();
      cursor += match[0].length;
    } else {
      break;
    }
    consumed = true;
  }
  if (!consumed) throw new SyntaxError(`Empty compound selector in "${text}" at ${index}`);
  return { compound, end: cursor };
}

function parseComplex(text) {
  const source = text.trim();
  const parts = [];
  let cursor = 0;
  let combinator = null;
  while (cursor < source.length) {
    while (source[cursor] === ' ' || source[cursor] === '\n' || source[cursor] === '\t') cursor += 1;
    if ('>+~'.includes(source[cursor])) {
      combinator = source[cursor];
      cursor += 1;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
    }
    const { compound, end } = parseCompound(source, cursor);
    parts.push({ combinator: parts.length ? (combinator || ' ') : null, compound });
    combinator = null;
    cursor = end;
    let sawSpace = false;
    while (/\s/.test(source[cursor] || '')) { cursor += 1; sawSpace = true; }
    if (sawSpace && cursor < source.length && !'>+~'.includes(source[cursor])) combinator = ' ';
  }
  return parts;
}

export function parseSelector(text) {
  if (cache.has(text)) return cache.get(text);
  const parsed = splitSelectorList(text).map((item) => {
    // Relative selectors (used by :has) start with a combinator.
    const relative = /^[>+~]/.test(item);
    return { text: item, relative, parts: parseComplex(relative ? `:scope ${item}` : item) };
  });
  cache.set(text, parsed);
  return parsed;
}

export function specificity(complexText) {
  const [complex] = parseSelector(complexText);
  let ids = 0;
  let classes = 0;
  let types = 0;
  const visit = (compound) => {
    ids += compound.ids.length;
    classes += compound.classes.length + compound.attributes.length;
    if (compound.tag && compound.tag !== '*') types += 1;
    if (compound.pseudoElement) types += 1;
    for (const pseudo of compound.pseudos) {
      if (pseudo.name === 'where') continue;
      if (['not', 'is', 'has', 'matches'].includes(pseudo.name)) {
        const best = parseSelector(pseudo.argument).map((inner) => specificity(inner.text))
          .sort((left, right) => compareSpecificity(right, left))[0] || [0, 0, 0];
        ids += best[0]; classes += best[1]; types += best[2];
      } else {
        classes += 1;
      }
    }
  };
  for (const part of complex.parts) visit(part.compound);
  return [ids, classes, types];
}

export function compareSpecificity(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function elementSiblings(element) {
  const parent = element.parentNode;
  if (!parent) return [element];
  return parent.childNodes.filter((node) => node.nodeType === 1);
}

function attributeMatches(element, { name, operator, value, insensitive }) {
  if (!element.hasAttribute(name)) return false;
  if (!operator) return true;
  let actual = element.getAttribute(name);
  let expected = value;
  if (insensitive) { actual = actual.toLowerCase(); expected = expected.toLowerCase(); }
  switch (operator) {
    case '=': return actual === expected;
    case '~=': return actual.split(/\s+/).includes(expected);
    case '|=': return actual === expected || actual.startsWith(`${expected}-`);
    case '^=': return expected !== '' && actual.startsWith(expected);
    case '$=': return expected !== '' && actual.endsWith(expected);
    case '*=': return expected !== '' && actual.includes(expected);
    default: return false;
  }
}

const FORM_CONTROLS = new Set(['button', 'input', 'select', 'textarea', 'optgroup', 'option', 'fieldset']);

/**
 * Whether a form control is disabled (HTML "actually disabled"): its own
 * attribute, a disabled optgroup (options), or a disabled fieldset ancestor
 * unless the control is inside that fieldset's first legend.
 */
export function isDisabledControl(element) {
  if (!FORM_CONTROLS.has(element.localName)) return false;
  if (element.hasAttribute('disabled')) return true;
  if (element.localName === 'option') return element.parentNode?.localName === 'optgroup' && element.parentNode.hasAttribute('disabled');
  if (element.localName === 'optgroup') return false;
  for (let node = element.parentNode; node?.nodeType === 1; node = node.parentNode) {
    if (node.localName !== 'fieldset' || !node.hasAttribute('disabled')) continue;
    const legend = node.children.find((child) => child.localName === 'legend');
    if (!legend || !legend.contains(element)) return true;
  }
  return false;
}

const UNVALIDATED_INPUT_TYPES = new Set(['hidden', 'button', 'reset', 'submit', 'image']);

/** Whether a control is a candidate for constraint validation. */
export function willValidate(element) {
  if (!['input', 'select', 'textarea'].includes(element.localName)) return false;
  if (element.localName === 'input' && UNVALIDATED_INPUT_TYPES.has(element.type)) return false;
  if (isDisabledControl(element)) return false;
  if (element.localName !== 'select' && element.hasAttribute('readonly')) return false;
  return !element.closest('datalist');
}

/** The control's ValidityState (required, number range/step, pattern, email, custom). */
export function validityOf(element) {
  const state = {
    valueMissing: false, typeMismatch: false, patternMismatch: false, tooLong: false, tooShort: false,
    rangeUnderflow: false, rangeOverflow: false, stepMismatch: false, badInput: false,
    customError: Boolean(element._validationMessage), valid: true,
  };
  if (!willValidate(element)) return state;
  const type = element.localName === 'input' ? element.type : element.localName;
  const value = String(element.value ?? '');
  if (element.hasAttribute('required')) {
    if (type === 'checkbox') state.valueMissing = !element.checked;
    else if (type === 'radio') {
      const scope = element.closest('form') || element.ownerDocument;
      state.valueMissing = !scope.querySelectorAll('input[type="radio"]').some((peer) => peer.name === element.name && peer.checked);
    } else state.valueMissing = value === '';
  }
  if (type === 'number' && value !== '') {
    const number = Number(value);
    if (!Number.isFinite(number)) state.badInput = true;
    else {
      const min = element.hasAttribute('min') ? Number(element.getAttribute('min')) : null;
      const max = element.hasAttribute('max') ? Number(element.getAttribute('max')) : null;
      if (Number.isFinite(min) && number < min) state.rangeUnderflow = true;
      if (Number.isFinite(max) && number > max) state.rangeOverflow = true;
      const step = element.getAttribute('step');
      const size = step === null ? 1 : Number(step);
      if (step !== 'any' && Number.isFinite(size) && size > 0) {
        const steps = (number - (Number.isFinite(min) ? min : 0)) / size;
        if (Math.abs(steps - Math.round(steps)) > 1e-9) state.stepMismatch = true;
      }
    }
  }
  if (type === 'email' && value !== '' && !/^[^\s@]+@[^\s@]+$/.test(value)) state.typeMismatch = true;
  const pattern = element.getAttribute('pattern');
  if (pattern !== null && value !== '' && ['text', 'search', 'url', 'tel', 'email', 'password'].includes(type)) {
    let expression = null;
    try { expression = new RegExp(`^(?:${pattern})$`, 'v'); } catch { expression = null; }
    if (expression && !expression.test(value)) state.patternMismatch = true;
  }
  state.valid = !Object.entries(state).some(([key, flag]) => key !== 'valid' && flag);
  return state;
}

function isInvalid(element) {
  if (element.localName === 'form' || element.localName === 'fieldset') {
    return element.querySelectorAll('input, select, textarea').some((control) => !validityOf(control).valid);
  }
  return willValidate(element) && !validityOf(element).valid;
}

function pseudoMatches(element, { name, argument }, context) {
  switch (name) {
    case 'not': return !matchesSelector(element, argument, context);
    case 'is':
    case 'where':
    case 'matches': return matchesSelector(element, argument, context);
    case 'has': return parseSelector(argument).some((complex) => {
      const scoped = { ...context, scope: element };
      if (complex.relative) {
        const [first] = complex.parts.slice(1);
        if (first?.combinator === '+' || first?.combinator === '~') {
          return elementSiblings(element).some((candidate) => matchesComplex(candidate, complex, scoped));
        }
      }
      return element.querySelectorAll('*').some((candidate) => (
        complex.relative ? matchesComplex(candidate, complex, scoped) : matchesComplex(candidate, complex, context)
      ));
    });
    case 'scope': return context.scope ? element === context.scope : element === element.ownerDocument?.documentElement;
    case 'root': return element === element.ownerDocument?.documentElement;
    case 'first-child': return elementSiblings(element)[0] === element;
    case 'last-child': return elementSiblings(element).at(-1) === element;
    case 'only-child': return elementSiblings(element).length === 1;
    case 'first-of-type': return elementSiblings(element).find((node) => node.localName === element.localName) === element;
    case 'last-of-type': return elementSiblings(element).filter((node) => node.localName === element.localName).at(-1) === element;
    case 'nth-child': return nthMatches(parseNth(argument), elementSiblings(element).indexOf(element) + 1);
    case 'nth-last-child': {
      const siblings = elementSiblings(element);
      return nthMatches(parseNth(argument), siblings.length - siblings.indexOf(element));
    }
    case 'nth-of-type': {
      const siblings = elementSiblings(element).filter((node) => node.localName === element.localName);
      return nthMatches(parseNth(argument), siblings.indexOf(element) + 1);
    }
    case 'empty': return element.childNodes.every((node) => node.nodeType === 8 || (node.nodeType === 3 && node.textContent === ''));
    case 'checked': return element.checked === true || (element.localName === 'option' && element.selected === true);
    case 'disabled': return isDisabledControl(element);
    case 'enabled': return FORM_CONTROLS.has(element.localName) && !isDisabledControl(element);
    case 'focus': return element.ownerDocument?.activeElement === element;
    case 'focus-within': return Boolean(element.ownerDocument?.activeElement && element.contains(element.ownerDocument.activeElement));
    // A style probe names the state element explicitly; otherwise it is the focused element.
    case 'focus-visible': return Boolean(context.states?.has('focus-visible')
      && (context.stateElement ? context.stateElement === element : element.ownerDocument?.activeElement === element));
    case 'hover':
    case 'active':
    case 'visited':
    case 'target':
    case 'focus-within-visible':
      return Boolean(context.states?.has(name) && (context.stateElement ? context.stateElement === element : true));
    case 'link':
    case 'any-link': return element.localName === 'a' && element.hasAttribute('href');
    case 'defined': return true;
    case 'placeholder-shown': return element.hasAttribute('placeholder') && !element.value;
    case 'required': return element.hasAttribute('required');
    case 'optional': return FORM_CONTROLS.has(element.localName) && !element.hasAttribute('required');
    case 'invalid': return isInvalid(element);
    case 'valid': return (willValidate(element) || ['form', 'fieldset'].includes(element.localName)) && !isInvalid(element);
    // :user-invalid needs a user edit or submit attempt, which tests do not model.
    case 'user-invalid': return false;
    case 'read-only': return element.hasAttribute('readonly');
    case 'indeterminate': return element.indeterminate === true;
    case 'open': return element.hasAttribute('open');
    case 'modal': return element.localName === 'dialog' && element._modal === true;
    case 'popover-open': return false;
    case 'lang': return (element.closest('[lang]')?.getAttribute('lang') || '').startsWith(argument);
    case 'dir': return (element.closest('[dir]')?.getAttribute('dir') || 'ltr') === argument;
    default:
      if (name.startsWith('-webkit-') || name.startsWith('-moz-')) return false;
      throw new SyntaxError(`Unsupported pseudo-class :${name}`);
  }
}

function compoundMatches(element, compound, context) {
  if (!element || element.nodeType !== 1) return false;
  if (compound.pseudoElement && !context.allowPseudoElements) return false;
  if (compound.tag && compound.tag !== '*' && element.localName !== compound.tag) return false;
  for (const id of compound.ids) if (element.id !== id) return false;
  for (const className of compound.classes) if (!element.classList.contains(className)) return false;
  for (const attribute of compound.attributes) if (!attributeMatches(element, attribute)) return false;
  for (const pseudo of compound.pseudos) if (!pseudoMatches(element, pseudo, context)) return false;
  return true;
}

function matchesFrom(element, parts, index, context) {
  if (!compoundMatches(element, parts[index].compound, context)) return false;
  if (index === 0) return true;
  const { combinator } = parts[index];
  if (combinator === '>') {
    const parent = element.parentNode;
    return parent?.nodeType === 1 && matchesFrom(parent, parts, index - 1, context);
  }
  if (combinator === ' ') {
    for (let ancestor = element.parentNode; ancestor?.nodeType === 1; ancestor = ancestor.parentNode) {
      if (matchesFrom(ancestor, parts, index - 1, context)) return true;
    }
    return false;
  }
  const siblings = elementSiblings(element);
  const position = siblings.indexOf(element);
  if (combinator === '+') return position > 0 && matchesFrom(siblings[position - 1], parts, index - 1, context);
  if (combinator === '~') {
    for (let cursor = position - 1; cursor >= 0; cursor -= 1) {
      if (matchesFrom(siblings[cursor], parts, index - 1, context)) return true;
    }
    return false;
  }
  throw new SyntaxError(`Unknown combinator ${combinator}`);
}

export function matchesComplex(element, complex, context = {}) {
  return matchesFrom(element, complex.parts, complex.parts.length - 1, context);
}

export function matchesSelector(element, selector, context = {}) {
  return parseSelector(selector).some((complex) => matchesComplex(element, complex, context));
}

export function pseudoElementOf(complexText) {
  const [complex] = parseSelector(complexText);
  return complex.parts.at(-1).compound.pseudoElement;
}
