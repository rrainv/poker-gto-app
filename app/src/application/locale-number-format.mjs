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
  });
}
