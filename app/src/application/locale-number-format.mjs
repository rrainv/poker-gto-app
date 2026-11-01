// LOCALE-NUMBERS-001: the one formatter for user-facing numbers. Numbers follow
// the UI language (en / ru / he), never the operating system's locale.
// Presentation only: callers pass already-computed values; nothing here does
// poker maths. A value that is not a finite number is unknown and renders as
// '-', never as zero.
export const LOCALE_NUMBER_FORMAT_SCHEMA_VERSION = 'locale-number-format/v1';

const SUPPORTED_LOCALES = new Set(['en', 'ru', 'he']);
const FORMATTER_CACHE = new Map();
export const UNKNOWN_NUMBER_TEXT = '-';

export function activeLocale(language) {
  const raw = typeof language === 'string' && language.trim()
    ? language
    : typeof window !== 'undefined' && typeof window.appLang === 'string' && window.appLang.trim()
      ? window.appLang
      : typeof document !== 'undefined' && typeof document.documentElement?.lang === 'string' && document.documentElement.lang.trim()
        ? document.documentElement.lang
        : 'en';
  const normalized = String(raw).trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.has(normalized) ? normalized : 'en';
}

function getFormatter(locale, minimumFractionDigits, maximumFractionDigits, useGrouping = true) {
  const key = `${locale}:${minimumFractionDigits}:${maximumFractionDigits}:${useGrouping ? 1 : 0}`;
  let formatter = FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

export function formatLocaleNumber(value, options = {}, language) {
  if (value === null || value === undefined || value === '') return UNKNOWN_NUMBER_TEXT;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return UNKNOWN_NUMBER_TEXT;
  const locale = activeLocale(language ?? options?.language);
  const minimumFractionDigits = Number.isInteger(options?.minimumFractionDigits)
    ? options.minimumFractionDigits
    : 0;
  const maximumFractionDigits = Number.isInteger(options?.maximumFractionDigits)
    ? Math.max(minimumFractionDigits, options.maximumFractionDigits)
    : Math.max(minimumFractionDigits, 2);
  const useGrouping = options?.useGrouping !== false;
  const normalized = Object.is(numeric, -0) ? 0 : numeric;
  const text = getFormatter(locale, minimumFractionDigits, maximumFractionDigits, useGrouping).format(normalized);
  // A value that rounds to zero is shown as zero, not "-0".
  return text.replace(/^[-−](?=0(?:\D0*)?$)/, '');
}

export function formatLocaleFixed(value, digits = 1, language, { useGrouping = false } = {}) {
  const d = Number.isInteger(digits) && digits >= 0 ? digits : 0;
  return formatLocaleNumber(value, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping }, language);
}

export function formatLocaleInteger(value, language) {
  return formatLocaleNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true }, language);
}

export function formatLocalePercent(value, digits = 1, language) {
  const text = formatLocaleFixed(value, digits, language);
  return text === UNKNOWN_NUMBER_TEXT ? text : `${text}%`;
}

export function formatLocaleBb(value, language) {
  const text = formatLocaleNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 }, language);
  return text === UNKNOWN_NUMBER_TEXT ? text : `${text} bb`;
}

// LOCALE-NUMBERS-003: number entry. Typed or pasted text accepts "." and ","
// whatever the UI language is; the app language only decides how a value is
// displayed back (RU "1,5", EN and HE "1.5"). Presentation only.
const BIDI_MARKS = /[‎‏؜]/g;
const SPACE_LIKE = /[\s'’]/g;
const MINUS_LIKE = /[−–‐]/g;

function groupedPattern(separator) {
  return separator === '.' ? /^\d{1,3}(?:\.\d{3})+$/ : /^\d{1,3}(?:,\d{3})+$/;
}

// Returns a finite number, or NaN for anything that is not one complete number.
// A single "." or "," is a decimal separator ("1,234" is 1.234); several of the
// same kind, or both kinds together ("1,234.5", "1.234,5"), mark thousands groups
// when the groups are three digits wide. "2." and ".5" are accepted drafts.
export function parseLocaleNumber(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : Number.NaN;
  if (typeof text !== 'string') return Number.NaN;
  const cleaned = text.replace(BIDI_MARKS, '').replace(MINUS_LIKE, '-').replace(SPACE_LIKE, '');
  const match = /^([+-]?)([\d.,]+)$/.exec(cleaned);
  if (!match) return Number.NaN;
  const negative = match[1] === '-';
  const body = match[2];
  const dots = body.split('.').length - 1;
  const commas = body.split(',').length - 1;
  let normalized;
  if (dots > 0 && commas > 0) {
    const decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    const parts = body.split(decimal);
    if (parts.length !== 2 || !/^\d*$/.test(parts[1]) || !groupedPattern(group).test(parts[0])) return Number.NaN;
    normalized = `${parts[0].split(group).join('')}.${parts[1]}`;
  } else if (dots + commas > 1) {
    const separator = dots > 0 ? '.' : ',';
    if (!groupedPattern(separator).test(body)) return Number.NaN;
    normalized = body.split(separator).join('');
  } else {
    normalized = body.replace(',', '.');
  }
  if (!/\d/.test(normalized)) return Number.NaN;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return Number.NaN;
  return value === 0 ? 0 : (negative ? -value : value);
}

// Display text for an input field: the app language's decimal separator, no
// thousands grouping, no padding. A non-number is an empty field, never "-" or 0.
export function formatLocaleInputNumber(value, language, maximumFractionDigits = 6) {
  const numeric = typeof value === 'number' ? value : parseLocaleNumber(String(value ?? ''));
  if (!Number.isFinite(numeric)) return '';
  return formatLocaleNumber(numeric, { minimumFractionDigits: 0, maximumFractionDigits, useGrouping: false }, language)
    .replace(BIDI_MARKS, '');
}

// The page bridge (window.RiverlineLocaleNumberFormat) as a plain object.
export function createLocaleNumberFormatBridge() {
  return Object.freeze({
    schemaVersion: LOCALE_NUMBER_FORMAT_SCHEMA_VERSION,
    activeLocale,
    formatNumber: formatLocaleNumber,
    formatFixed: formatLocaleFixed,
    formatInteger: formatLocaleInteger,
    formatPercent: formatLocalePercent,
    formatBb: formatLocaleBb,
    parseNumber: parseLocaleNumber,
    formatInputNumber: formatLocaleInputNumber,
  });
}
